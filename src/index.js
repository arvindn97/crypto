const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const ssmClient = new SSMClient();
const ssmParameterPath = process.env.ssmParameterPath;
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
              console.log("API Key:",apiKey);
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
            console.log("eventBody:",eventBody)
        }
        else {

        }
        break;
      // handle unsupported paths
      default:
        break;
    }
  } catch (error) {
    console.error(error);
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
    throw { statusCode: 502, message: "Failed to fetch API Key" }
  }
}

//function to structure response to APIGW
const apiResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',  // Allow all domains
      'Access-Control-Allow-Methods': 'POST',  // Allowed methods
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',  // Allowed headers
      'Access-Control-Allow-Credentials': 'true',  // Allow credentials
    },
    body: JSON.stringify(body),
  };
};