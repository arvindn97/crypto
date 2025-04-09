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