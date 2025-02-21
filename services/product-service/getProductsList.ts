import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async () => {
  const products = [
    { id: '1', title: 'ProductA', description:'This is product A description', price: 100 },
    { id: '2', title: 'ProductB',description:'This is product B description', price: 200 },
    { id: '3', title: 'ProductC',description:'This is product C description', price: 300 },
  ];

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(products),
  };
};
