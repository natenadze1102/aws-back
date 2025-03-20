import { SQSEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

// Функция для генерации ID, если его нет
const generateId = () => Math.random().toString(36).substring(2, 15);

export const handler = async (event: SQSEvent) => {
  console.log('Received SQS event:', JSON.stringify(event));

  const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-central-1' });
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

  let processedCount = 0;
  let minPrice = Infinity;
  const processedProducts: Array<{
    title: string;
    description: string;
    price: number;
    count: number;
  }> = [];

  // Обрабатываем каждое сообщение из очереди
  for (const record of event.Records) {
    try {
      const product = JSON.parse(record.body);

      // Подготовка параметров для записи в DynamoDB
      const params = {
        TableName: process.env.PRODUCTS_TABLE_NAME!,
        Item: {
          id: { S: product.id || generateId() },
          title: { S: product.title },
          description: { S: product.description || '' },
          price: { N: product.price.toString() },
          count: { N: product.count.toString() },
        },
      };

      // Запись товара в DynamoDB
      await dynamoClient.send(new PutItemCommand(params));
      processedCount++;

      // Отслеживаем минимальную цену
      const price = typeof product.price === 'number' ? product.price : parseFloat(product.price);
      if (!isNaN(price)) {
        minPrice = Math.min(minPrice, price);
      }

      // Добавляем детали товара в массив для уведомления
      processedProducts.push({
        title: product.title,
        description: product.description,
        price: price,
        count: Number(product.count),
      });
    } catch (error) {
      console.error('Error processing record:', record, error);
      // При необходимости можно выбросить ошибку, чтобы сообщение вернулось в очередь
    }
  }

  const priceCategory = minPrice < 20 ? 'low' : 'high';

  // Формируем сообщение с подробной информацией о продуктах
  const messageBody = {
    summary: `Successfully processed ${processedCount} product(s)`,
    products: processedProducts,
  };

  // Отправляем уведомление SNS с собранной информацией
  try {
    const publishParams = {
      TopicArn: process.env.CREATE_PRODUCT_TOPIC_ARN!,
      Subject: 'Products Imported',
      Message: JSON.stringify(messageBody, null, 2),
      MessageAttributes: {
        priceCategory: {
          DataType: 'String',
          StringValue: priceCategory,
        },
      },
    };

    await snsClient.send(new PublishCommand(publishParams));
    console.log('SNS notification published');
  } catch (error) {
    console.error('Error publishing SNS notification:', error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Catalog batch processing complete' }),
  };
};
