const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { v4: uuidv4 } = require('uuid');
const client = new DynamoDBClient();
const sesClient = new SESClient();
const ssmClient = new SSMClient();
const moment = require('moment');
const ssmParameterPath = process.env.ssmParameterPath;
const senderEmail = process.env.senderEmail;
const apiEndpoint = process.env.apiEndpoint;
const TableName = process.env.TableName;

//Main Handler Function 
exports.handler = async (event) => {
  const invocationPath = event.path;
  const eventBody = JSON.parse(event.body);
  try {
    // determine which API endpoint is being invoked and route accordingly
    switch (invocationPath) {
      //Current Price Info API
      case '/currentPriceInfo':
        if (event.httpMethod == 'POST') {
          //Payload validation
          if (!eventBody.crypto || !eventBody.emailID || typeof eventBody.crypto !== 'string' || typeof eventBody.emailID !== 'string') {
            return apiResponse(400, { "message": "Invalid request body" })
          } else {
            try {
              let apiKey = await fetchAPIKey(ssmParameterPath); //retrieves apiKey from ssm parameter store
              let data = await fetchCryptoDetails(eventBody, apiKey); // retrieves crypto response from codeGecko API
              let dbInsertResult = await saveCryptoDetails(eventBody, data); //inserts the retrieved codeGecko API's response to DB
              let emailData = await sendEmail(eventBody, data); // triggers mail to the user on the retrieved data
              //Framing response object
              let responseStructure = {
                crypto: Object.keys(dbInsertResult.message)[0],
                price: "A$ " + dbInsertResult.message[eventBody.crypto].aud,
                marketCap: "A$ " + dbInsertResult.message[eventBody.crypto].aud_market_cap,
                volume24h: "A$ " + dbInsertResult.message[eventBody.crypto].aud_24h_vol,
                change24h: "A$ " + dbInsertResult.message[eventBody.crypto].aud_24h_change,
                timestamp: moment().format("DD-MM-YYYY HH:mm:ss")
              }
              return apiResponse(dbInsertResult.statusCode, responseStructure);
            } catch (error) {
              console.error(error);
              return apiResponse(error.statusCode, error.message);
            }
          }
        }
        else {
          return apiResponse(405, { "message": `${event.httpMethod} is not allowed. Allowed Methods: POST` })
        }
        break;
      //Get Search History API
      case '/getSearchHistory':
        if (event.httpMethod == 'POST') {
          //Payload validation
          if (!eventBody.emailID || typeof eventBody.emailID !== 'string') {
            return apiResponse(400, { "message": "Invalid request body" })
          } else {
            try {
              let data = await fetchSearchHistory(eventBody);  // retrieves user specific search history from DB
              return apiResponse(data.statusCode, {"searchHistory":data.message});
            } catch (error) {
              console.error(error);
              return apiResponse(error.statusCode, error.message);
            }
          }
        }
        else {
          return apiResponse(405, { "message": `${event.httpMethod} is not allowed. Allowed Methods: POST` })
        }
        break;
      // handle unsupported paths
      default:
        return apiResponse(404, { "message": "Invalid Invocation Method" })
        break;
    }
  } catch (error) {
    console.error(error);
    return apiResponse(500, { "message": "Internal Server Error" })
  }
};

//function to fetch codeGecko API Key from SSM Parameter Store
async function fetchAPIKey(key) {
  try {
    const params = {
      Name: key
    };
    const command = new GetParameterCommand(params);
    const response = await ssmClient.send(command); //retrieves ssm parameter details
    return response.Parameter.Value;
  } catch (error) {
    console.error(error);
    throw { statusCode: 500, message: "Failed to fetch API Key" }
  }
}

//function to fetch crypto details from codeGecko API (third-party API)
async function fetchCryptoDetails(eventBody, apiKey) {
  //Currently supports only one crypto insertion. Needs iteration support for multiple coins.
  let ids = eventBody.crypto.split(','); //for enabling multiple crypto request support in future if required
  let queryParams = '?vs_currencies=aud&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true&precision=2&ids=';
  queryParams += ids.join('%2C'); //for enabling multiple crypto to append in queryParam for future if required
  let url = apiEndpoint + queryParams;
  const options = {
    method: 'GET',
    headers: { accept: 'application/json', 'x-cg-demo-api-key': apiKey }
  };
  try {
    const response = await fetch(url, options); //makes http call to the codeGecko API
    const data = await response.json();
    //validating if crypto entered by user exists
    if (Object.keys(data).length == 0) {
      throw { statusCode: 400, message: `Cryptocurrency "${eventBody.crypto}" does not exist or is not supported.` } //custom error throw for non existing crypto
    } else {
      let responseObj = {
        "statusCode": 200,
        "message": data
      }
      return responseObj;
    }
  } catch (error) {
    console.error(error);
    //preserve custom thrown errors
    if (error.statusCode && error.message) {
      throw error;
    }
    //fallback for unexpected errors
    throw { statusCode: 500, message: "Failed to fetch data from external API" }
  }
}

//function to insert the crypto details received from codeGecko API to DynamoDB
async function saveCryptoDetails(eventBody, data) {
  try {
    // Currently supports only one crypto insertion. Needs iteration support for multiple coins.
    const params = {
      TableName: TableName,
      Item: marshall({
        "ID": uuidv4(),
        "crypto": eventBody.crypto,
        "emailID": eventBody.emailID,
        "price": "A$" + data.message[eventBody.crypto].aud,
        "marketCap": data.message[eventBody.crypto].aud_market_cap,
        "volume24h": data.message[eventBody.crypto].aud_24h_vol,
        "change24h": data.message[eventBody.crypto].aud_24h_change,
        "timestamp": moment().format('YYYY-MM-DD HH:mm:ss')
      })
    };
    const command = new PutItemCommand(params);
    const response = await client.send(command);
    return data;
  } catch (error) {
    console.error(error);
    throw { statusCode: 500, message: "Failed to input data to DB" }
  }
}

//function to trigger mail on the requested cryptoDetails to user
async function sendEmail(eventBody, data) {
  // Currently supports only one crypto at a time. Needs loop for multiple coins.
  try {
    // declaring email body
    const emailBodyText = `
      Hi ${eventBody.emailID},

      Here is your requested cryptocurrency price update:

      Cryptocurrency: ${eventBody.crypto}
      Current Price: A$ ${data.message[eventBody.crypto].aud}
      Market Cap: A$ ${data.message[eventBody.crypto].aud_market_cap}
      Volume (24h): A$ ${data.message[eventBody.crypto].aud_24h_vol}
      Change (24h): A$ ${data.message[eventBody.crypto].aud_24h_change}

      We hope this helps you stay on top of the market trends.

      If you like to get more updates, feel free to come back and use our service anytime.

      Warm regards,
      Crypto Checkers  
    `
    const params = {
      Destination: {
        ToAddresses: [eventBody.emailID],
      },
      Message: {
        Body: {
          Text: {
            Data: emailBodyText,
          },
        },
        Subject: {
          Data: "Crypto Price Alert",
        },
      },
      Source: senderEmail,
    };
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    return response;
  } catch (error) {
    console.error(error);
    throw { statusCode: 500, message: "Failed to send email" }
  }
}

//function to query the user specific crypto search history
async function fetchSearchHistory(eventBody) {
  try {
    const params = {
      ExpressionAttributeValues: {
        ":emailID": marshall(eventBody.emailID)
      },
      ExpressionAttributeNames: {
        "#timestamp": "timestamp",
        "#crypto": "crypto",
        "#price": "price"
      },
      KeyConditionExpression: "emailID = :emailID",
      ProjectionExpression: "#crypto, #price, #timestamp",
      TableName: TableName,
      IndexName: "emailID-index",
    };
    const command = new QueryCommand(params);
    const response = await client.send(command);
    let unmarshalledItems = response.Items.map(item => unmarshall(item)); // unmarshalling the response
    let responseObj = {
      "statusCode": 200,
      "message": unmarshalledItems
    }
    return responseObj;
  } catch (error) {
    console.error(error);
    throw { statusCode: 500, message: "Failed to fetch data from DB" }
  }
}

//function to structure response to APIGW
const apiResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',  // Allow all domains
      'Access-Control-Allow-Methods': 'POST, OPTIONS',  // Allowed methods
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',  // Allowed headers
      'Access-Control-Allow-Credentials': 'true',  // Allow credentials
    },
    body: JSON.stringify(body),
  };
};