const middy = require('middy');
const { cors } = require('middy/middlewares');
const { SQS } = require('aws-sdk');
const crypto = require('crypto');

const sqs = new SQS();

function extract(data) {
  const KEYS = [
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
    'updatedBy',
  ];

  return KEYS.reduce((res, key) => {
    return {
      ...res,
      [key]: data[key] || ''
    };
  }, {});
}

const publish = async (event) => {
  let statusCode = 200;
  let message;


  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'No body was found',
      }),
    };
  }

  const { id, data } = JSON.parse(event.body);

  if (!id || !data) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Malformed request',
      }),
    };
  }

  const queueUrl = process.env.QUEUE_URL;
  const messageBody = {
    id,
    data: extract(data),
  };
  const hash = crypto.createHash('sha256');

  try {
    await sqs.sendMessage({
      QueueUrl: queueUrl,
      MessageGroupId: id,
      MessageBody: JSON.stringify(messageBody),
      MessageDeduplicationId: hash.update(messageBody.data.rcp_item).digest('hex'),
    }).promise();

    message = 'Success';

  } catch (error) {
    console.log(error);
    message = error.message;
    statusCode = 500;
  }

  return {
    statusCode,
    body: JSON.stringify({
      message,
    }),
  };
};

const handler = middy(publish).use(cors());

module.exports.handler = handler;
