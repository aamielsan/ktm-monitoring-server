const createEvent = require("@serverless/event-mocks").default;

function mockApi(body) {
  return createEvent(
    "aws:apiGateway",
    {
      body
    }
  );
}

module.exports = mockApi;
