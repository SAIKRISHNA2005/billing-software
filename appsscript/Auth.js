/**
 * Transport & Logistics Management System (TMS)
 * Authentication Module
 * Single-user architecture with salted SHA-256 and CacheService rate-limiting.
 */

const AuthModule = {
  /**
   * Computes SHA-256 hash of (salt + password)
   */
  hashPassword(plainPassword, salt) {
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      salt + plainPassword,
      Utilities.Charset.UTF_8
    );
    return digest
      .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2))
      .join('');
  },

  /**
   * Verifies plain password against salt and expected hash
   */
  verifyPassword(plainPassword, salt, expectedHash) {
    if (!plainPassword || !salt || !expectedHash) return false;
    const computed = this.hashPassword(plainPassword, salt);
    return computed === expectedHash;
  },

  /**
   * Action: "login"
   * Rate limited: 5 failures in 10 minutes triggers temporary lockout.
   */
  login(payload) {
    const email = (payload.email || '').trim().toLowerCase();
    const password = payload.password || '';

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const cache = CacheService.getScriptCache();
    const lockoutKey = 'lockout_' + email;
    const attemptsKey = 'attempts_' + email;

    // 1. Check if currently locked out
    const isLockedOut = cache.get(lockoutKey);
    if (isLockedOut) {
      throw new Error(
        'Too many failed login attempts. This account is temporarily locked out. Please try again in 10 minutes.'
      );
    }

    // 2. Fetch single user record from users sheet
    const users = SheetRepo.getAllRows('users', true);
    const user = users.find((u) => (u.email || '').trim().toLowerCase() === email);

    // 3. Verify password
    let passwordValid = false;
    if (user && user.passwordHash && user.salt) {
      passwordValid = this.verifyPassword(password, user.salt, user.passwordHash);
    }

    if (!user || !passwordValid) {
      // Increment failed attempt counter
      let attempts = parseInt(cache.get(attemptsKey) || '0', 10) + 1;
      cache.put(attemptsKey, String(attempts), 600); // 10 minutes TTL

      if (attempts >= 5) {
        cache.put(lockoutKey, 'locked', 600); // Lock for 10 minutes
        cache.remove(attemptsKey);
        throw new Error(
          'Too many failed login attempts. This account is now locked for 10 minutes.'
        );
      }

      const remaining = 5 - attempts;
      throw new Error(
        `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout)`
      );
    }

    // 4. Successful login -> Clear rate-limiting counters
    cache.remove(attemptsKey);
    cache.remove(lockoutKey);

    // 5. Generate opaque session token
    const token =
      Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

    const scriptProps = PropertiesService.getScriptProperties();
    const ttlMinutes = parseInt(scriptProps.getProperty('SESSION_TTL_MINUTES') || '10080', 10); // Default 7 days
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

    // 6. Record session in sessions sheet
    SheetRepo.insertRow('sessions', {
      token,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt,
      lastActiveAt: now.toISOString(),
    });

    // 7. Audit log
    writeAuditLog('users', user.id, 'LOGIN', null, { email: user.email }, user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  },

  /**
   * Action: "logout"
   * Deletes session record from sessions sheet.
   */
  logout(sessionToken) {
    if (sessionToken) {
      deleteSessionByToken(sessionToken);
    }
    return { loggedOut: true };
  },

  /**
   * Action: "me"
   * Returns authenticated user profile.
   */
  me(sessionToken) {
    const session = requireSession(sessionToken);
    const user = SheetRepo.getRowById('users', session.userId);

    if (!user) {
      throw new Error('User profile not found.');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  },

  /**
   * Action: "changePassword"
   * Changes operator password, updates hash/salt, invalidates prior sessions.
   */
  changePassword(payload, sessionToken) {
    const session = requireSession(sessionToken);
    const currentPassword = payload.currentPassword || '';
    const newPassword = payload.newPassword || '';

    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required.');
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const user = SheetRepo.getRowById('users', session.userId);
    if (!user) {
      throw new Error('User record not found.');
    }

    if (!this.verifyPassword(currentPassword, user.salt, user.passwordHash)) {
      throw new Error('Incorrect current password.');
    }

    // Generate new salt and hash
    const newSalt = Utilities.getUuid().replace(/-/g, '');
    const newHash = this.hashPassword(newPassword, newSalt);

    SheetRepo.updateRow('users', user.id, {
      passwordHash: newHash,
      salt: newSalt,
      updatedAt: new Date().toISOString(),
    });

    writeAuditLog('users', user.id, 'CHANGE_PASSWORD', null, { status: 'SUCCESS' }, user.id);

    return {
      success: true,
      message: 'Password changed successfully. Please log in with your new password.',
    };
  },
};
