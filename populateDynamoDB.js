import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Initialize DynamoDB Client
const client = new DynamoDBClient({ region: 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Sample data
const products = [
  {
    id: uuidv4(),
    title: 'First Product',
    description: 'This is description for first product',
    price: 1500,
  },
  {
    id: uuidv4(),
    title: 'Second Product',
    description: 'This is description for second product',
    price: 2000,
  },
];

const stocks = products.map((product) => ({
  product_id: product.id,
  count: Math.floor(Math.random() * 100), // Random stock count
}));

// Function to insert data
const insertData = async () => {
  try {
    for (const product of products) {
      await docClient.send(
        new PutCommand({
          TableName: 'products',
          Item: product,
        })
      );
      console.log(`Inserted product: ${product.title}`);
    }

    for (const stock of stocks) {
      await docClient.send(
        new PutCommand({
          TableName: 'stocks',
          Item: stock,
        })
      );
      console.log(`Inserted stock for product: ${stock.product_id}`);
    }

    console.log('Data inserted successfully!');
  } catch (error) {
    console.error('Error inserting data:', error);
  }
};

// Execute the function
insertData();
