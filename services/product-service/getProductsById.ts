import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  const { productId } = event.pathParameters || {};

  const products = [
    { id: '1', name: 'ProductA', price: 100 },
    { id: '2', name: 'ProductB', price: 200 },
  ];

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Product not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(product),
  };
};
