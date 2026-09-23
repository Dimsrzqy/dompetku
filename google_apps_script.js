// Google Apps Script Code — CatatUang (Multi-User & Robust Backend)
// Salin seluruh kode ini ke Google Apps Script (Di Google Sheets: Ekstensi > Apps Script)

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // Selalu gunakan Sheet pertama
    
    ensureHeader(sheet);

    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'read';

    if (action === 'add') {
      return handleAdd(sheet, e.parameter);
    } else if (action === 'delete') {
      return handleDelete(sheet, e.parameter);
    } else {
      return handleRead(sheet, e ? e.parameter : {});
    }
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // Selalu gunakan Sheet pertama
    
    ensureHeader(sheet);

    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch(err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const action = data.action || 'add';

    if (action === 'delete') {
      return handleDelete(sheet, data);
    } else {
      return handleAdd(sheet, data);
    }
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Tanggal", "Tipe", "Kategori", "Nominal", "Keterangan", "User"]);
  }
}

function handleRead(sheet, params) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return createJsonResponse({ status: "success", data: [] });
  }

  const targetUser = params.user ? String(params.user).trim().toLowerCase() : '';
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[4]) continue; // Skip baris kosong

    const rowUser = row[6] ? String(row[6]).trim().toLowerCase() : '';

    if (!targetUser || rowUser === targetUser || rowUser === '' || rowUser === 'default') {
      rows.push({
        id: String(row[0] || i),
        tanggal: row[1] ? formatDate(row[1]) : '',
        tipe: row[2] || 'pemasukan',
        kategori: row[3] || '-',
        nominal: Number(row[4]) || 0,
        keterangan: row[5] || '',
        user: row[6] || targetUser
      });
    }
  }

  return createJsonResponse({ status: "success", data: rows });
}

function handleAdd(sheet, data) {
  const id = data.id || Date.now().toString();
  const tanggal = data.tanggal || formatDate(new Date());
  const tipe = data.tipe || 'pemasukan';
  const kategori = data.kategori || '-';
  const nominal = Number(data.nominal) || 0;
  const keterangan = data.keterangan || '';
  const user = data.user ? String(data.user).trim().toLowerCase() : 'default';

  sheet.appendRow([id, tanggal, tipe, kategori, nominal, keterangan, user]);
  return createJsonResponse({ status: "success", message: "Data berhasil ditambahkan", id: id });
}

function handleDelete(sheet, data) {
  const targetId = String(data.id);
  const user = data.user ? String(data.user).trim().toLowerCase() : '';
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const rowId = String(values[i][0]);
    const rowUser = String(values[i][6] || '').trim().toLowerCase();

    if (rowId === targetId) {
      if (!user || rowUser === user) {
        sheet.deleteRow(i + 1);
        return createJsonResponse({ status: "success", message: "Data berhasil dihapus" });
      } else {
        return createJsonResponse({ status: "error", message: "Akses ditolak" });
      }
    }
  }

  return createJsonResponse({ status: "error", message: "ID tidak ditemukan" });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
