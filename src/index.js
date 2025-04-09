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
            console.log("eventBody:",eventBody);
            return apiResponse(200,{"message":"Success"});
        }
        else {

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