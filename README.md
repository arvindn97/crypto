# crypto
Cryptocurrency Current Price and Search History API

This project is a serverless AWS Lambda application that fetches real-time cryptocurrency price details using the CoinGecko API, stores user search history in DynamoDB, and sends price alerts via SES email.

# Features

- Fetch real-time cryptocurrency price info
- Send email alerts to users using AWS SES
- Save user-specific search history in DynamoDB
- Built with AWS SDK v3 and Node.js
- Uses public CoinGecko API 