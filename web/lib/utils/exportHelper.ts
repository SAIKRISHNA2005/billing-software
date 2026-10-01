/**
 * Helper utility to export tabular data as an Excel-compatible spreadsheet (.xlsx/.csv with UTF-8 BOM)
 */
export interface ExportColumn {
  key: string;
  title: string;
  render?: (val: any, record: any) => string | number;
}

export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  filename: string
): void {
  if (!data || data.length === 0) {
    return;
  }

  // Create formatted XML Spreadsheet (Excel 2003 XML format which natively opens in all versions of Microsoft Excel without warnings)
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#17324D" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataCell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Arial" ss:Size="10"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Sheet1">
  <Table>`;

  const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

  // Build Column Widths & Headers
  let headerRow = '   <Row ss:Height="24">\n';
  columns.forEach((col) => {
    headerRow += `    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.title)}</Data></Cell>\n`;
  });
  headerRow += '   </Row>\n';

  // Build Data Rows
  let dataRows = '';
  data.forEach((item) => {
    dataRows += '   <Row ss:Height="18">\n';
    columns.forEach((col) => {
      let rawVal = col.render ? col.render(item[col.key], item) : item[col.key];
      if (rawVal === undefined || rawVal === null) rawVal = '';

      const isNum = typeof rawVal === 'number' && !isNaN(rawVal);
      const styleId = isNum ? 'NumberCell' : 'DataCell';
      const dataType = isNum ? 'Number' : 'String';
      const valStr = isNum ? String(rawVal) : escapeXml(String(rawVal));

      dataRows += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="${dataType}">${valStr}</Data></Cell>\n`;
    });
    dataRows += '   </Row>\n';
  });

  const fullXml = xmlHeader + '\n' + headerRow + dataRows + xmlFooter;

  const blob = new Blob([fullXml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });

  const safeFilename = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
