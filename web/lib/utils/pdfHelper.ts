/**
 * Utility for number to words conversion in Indian Numbering System
 */
export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Zero Rupees Only';

  const rounded = Math.round(Number(amount));
  if (rounded === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num: number): string {
    const numStr = ('000000000' + num.toString()).slice(-9);
    const match = numStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!match) return '';

    let str = '';
    const cr = Number(match[1]);
    const lk = Number(match[2]);
    const th = Number(match[3]);
    const hd = Number(match[4]);
    const rm = Number(match[5]);

    str += cr !== 0 ? (a[cr] || b[Number(match[1][0])] + ' ' + a[Number(match[1][1])]) + ' Crore ' : '';
    str += lk !== 0 ? (a[lk] || b[Number(match[2][0])] + ' ' + a[Number(match[2][1])]) + ' Lakh ' : '';
    str += th !== 0 ? (a[th] || b[Number(match[3][0])] + ' ' + a[Number(match[3][1])]) + ' Thousand ' : '';
    str += hd !== 0 ? (a[hd] || b[Number(match[4][0])] + ' ' + a[Number(match[4][1])]) + ' Hundred ' : '';
    str += rm !== 0 ? ((str !== '') ? 'and ' : '') + (a[rm] || b[Number(match[5][0])] + ' ' + a[Number(match[5][1])]) + ' ' : '';
    return str.trim();
  }

  return 'Rupees ' + inWords(rounded) + ' Only';
}
