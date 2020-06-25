'use strict';

const AWSMock = require("aws-sdk-mock");
const AWS = require("aws-sdk"); 

const mochaPlugin = require('serverless-mocha-plugin');
const expect = mochaPlugin.chai.expect;
let wrapped = mochaPlugin.getWrapper('publish', '/src/publisher/publish.js', 'handler');

const mockApi = require('./utils/mockApi');
const mockData = require('./mocks/PublishData.json');

describe('publish', () => {
  before((done) => {
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('SQS', 'sendMessage', () => {});
    done();
  });

  it('should error if body not found', async () => {
    const response = await wrapped.run({});
    expect(response.statusCode).to.be.equal(400);
  });

  // it('should return valid response', async () => {
    // const data = mockApi(JSON.stringify(mockData));
    // const response = await wrapped.run(data);
    // expect(response.statusCode).to.be.equal(400);
  // });

  after((done) => {
    AWSMock.restore('SQS');
    done();
  })
});
