const { SecretsManager } = require('aws-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
 
const sm = new SecretsManager();

const googleEmail = process.env.GOOGLE_SA_EMAIL;
const googleSecretId = process.env.GOOGLE_PK_SECRET_ID;
let googlePrivateKey;

const CELL_FIELD = {
  0: 'rcp_item',
  1: 'rcp_payee',
  2: 'rcp_invoiceRef',
  3: 'rcp_amtPeso',
  4: 'rcp_amtDollar',
  5: 'rcp_particulars',
  6: 'rcp_dateDue',
  7: 'rcp_dateTransmitted',
  8: 'apv_dateTransaction',
  9: 'apv_no',
  10: 'apv_remarks',
  11: 'apv_dateTransmitted',
  12: 'apv_receivedBy',
  13: 'cdv_dateTransaction',
  14: 'cdv_no',
  15: 'cdv_checkNo',
  16: 'cdv_status',
  17: 'cdv_checkStatus',
  18: 'cdv_datePayment',
  19: 'updatedBy',
};

const getGoogleKey = async () => {
  try {
    const secret = await sm.getSecretValue({
      SecretId: googleSecretId
    }).promise();
    return secret.SecretString;
  } catch (e) {
    throw e;
  }
}

const loadGoogleSheet = async (id) => {
  try {
    const doc = new GoogleSpreadsheet(id);
    await doc.useServiceAccountAuth({
      client_email: googleEmail,
      private_key: googlePrivateKey,
    });
    await doc.loadInfo();
    return doc;
  } catch (e) {
    throw e;
  }
}

const findRowById = async (doc, id) => {
  try {
    const data = doc.sheetsByIndex[0];
    const meta = doc.sheetsByIndex[1];

    await meta.loadCells('A1');
    const count = meta.getCell(0, 0).value;

    await data.loadCells(`A1:A${count + 1}`)

    for (let i = 0; i < count; i++) {
      const dataId = data.getCell(i, 0).value;
      if (dataId === id) {
        return i;
      }
    }

    return -1;
  } catch (e) {
    throw e;
  }
}

const updateRecord = async (doc, record, row) => {
  try {
    console.log('Updating row for ', row, record.rcp_item);

    const sheet = doc.sheetsByIndex[0];
    await sheet.loadCells(`A${row + 1}:T${row + 1}`);
    for (let col = 0; col < 20; col++) {
      const cell = sheet.getCell(row, col);
      const value = record[CELL_FIELD[col]];
      cell.value = value;
    }
    await sheet.saveUpdatedCells();
  } catch (e) {
    throw e;
  }
}

const createRecord = async (doc, record) => {
  try {
    console.log('Creating new row for ', record.rcp_item);

    const meta = doc.sheetsByIndex[1];
    await meta.loadCells('A1');
    const countCell = meta.getCell(0, 0);

    const newCount = countCell.value + 1;
    await updateRecord(doc, record, newCount);

    countCell.value = newCount;
    await meta.saveUpdatedCells();
  } catch (e) {
    throw e;
  }
}

module.exports.handler = async (event) => {
  try {
    if (!googlePrivateKey) {
      googlePrivateKey = await getGoogleKey();
    }

    for (const record of event.Records) {
      const { id, data } = JSON.parse(record.body);

      if (!data || !data.rcp_item) {
        console.log('`rcp_item` field not found. Skipping...');
        continue;
      }

      const doc = await loadGoogleSheet(id);
      const row = await findRowById(doc, data.rcp_item);

      if (row > -1) {
        await updateRecord(doc, data, row);
      } else {
        await createRecord(doc, data);
      }

      doc.resetLocalCache();
    }

  } catch (error) {
    console.log(error);
  }
};
