const { SecretsManager } = require('aws-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
 
const sm = new SecretsManager();
const count = 1000;

const googleSheetId = process.env.GOOGLE_SHEET_ID;
const googleEmail = process.env.GOOGLE_SA_EMAIL;
const googleSecretId = process.env.GOOGLE_PK_SECRET_ID;
let googlePrivateKey;

const doc = new GoogleSpreadsheet(googleSheetId);

const CELL_FIELD = [
  'rcp_item',
  'rcp_payee',
  'rcp_invoiceRef',
  'rcp_amtPeso',
  'rcp_amtDollar',
  'rcp_particulars',
  'rcp_dateDue',
  'rcp_dateTransmitted',
  'apv_dateTransaction',
  'apv_no',
  'apv_remarks',
  'apv_dateTransmitted',
  'apv_receivedBy',
  'cdv_dateTransaction',
  'cdv_no',
  'cdv_checkNo',
  'cdv_status',
  'cdv_checkStatus',
  'cdv_datePayment',
  'cdv_orNo',
];

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

const loadGoogleSheet = async () => {
  try {
    await doc.useServiceAccountAuth({
      client_email: googleEmail,
      private_key: googlePrivateKey,
    });
    await doc.loadInfo();
  } catch (e) {
    throw e;
  }
}

const findRowById = async (id) => {
  try {
    console.log('Looking for id ', id);
    const data = doc.sheetsByIndex[0];
    await data.loadCells(`A1:A${count}`);
    console.log(data.cellStats);

    const strId = String(id).trim().toLowerCase();

    for (let i = 0; i < count; i++) {
      const dataId = data.getCell(i, 0).value;
      const strDataId = String(dataId).trim().toLowerCase();
      console.log('Checking row id ', {
        dataId,
        strDataId,
      });

      if (!dataId) {
        console.log('Reached new row ', i);
        return i;
      }

      if (strId === strDataId) {
        return i;
      }
    }

    return -1;
  } catch (e) {
    throw e;
  }
}

const updateRow = async (row, record) => {
  try {
    console.log('Updating row for ', row, record.rcp_item);

    const sheet = doc.sheetsByIndex[0];
    await sheet.loadCells(`A${row + 1}:T${row + 1}`);
    for (let col = 0; col < CELL_FIELD.length; col++) {
      const field = CELL_FIELD[col];
      const cell = sheet.getCell(row, col);
      const value = record[field];
      cell.value = value;
    }
    await sheet.saveUpdatedCells();
  } catch (e) {
    throw e;
  }
}

module.exports.handler = async (event) => {
  try {
    if (!googlePrivateKey) {
      googlePrivateKey = await getGoogleKey();
    }

    if (!doc._rawProperties) {
      await loadGoogleSheet();
    }

    for (const record of event.Records) {
      const { id, data } = JSON.parse(record.body);

      if (googleSheetId !== id) {
        console.log('Not a worker for the ID. Skipping...', data);
        continue;
      }

      if (!data || !data.rcp_item) {
        console.log('`rcp_item` field not found. Skipping...');
        continue;
      }

      const row = await findRowById(data.rcp_item);

      await updateRow(row, data);
    }

    doc.resetLocalCache();

  } catch (e) {
    console.log(e);
    throw e;
  }
};
