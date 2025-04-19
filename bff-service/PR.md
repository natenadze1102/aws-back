# Task 10 - Backend For Frontend (BFF) Service

## What was done

1. Created a new BFF service that acts as a proxy layer for backend services
2. Implemented routing of requests to appropriate services based on path
3. Added caching for product list endpoint with 2-minute expiration
4. Deployed the service to AWS Elastic Beanstalk
5. Ensured proper error handling for all request scenarios

## Service URLs

- **Product Service API**: https://nkxzg11gig.execute-api.eu-central-1.amazonaws.com/prod
- **Cart Service API**: https://ensi2pfsd7.execute-api.eu-central-1.amazonaws.com/prod
- **BFF Service API**: http://natenadze1102-bff-api-production.eu-central-1.elasticbeanstalk.com

## How to Call Services

### Product Service Examples

#### Direct call to Product Service:
```
curl https://nkxzg11gig.execute-api.eu-central-1.amazonaws.com/prod/products
```

#### Call via BFF Service:
```
curl http://natenadze1102-bff-api-production.eu-central-1.elasticbeanstalk.com/product/products
```

#### Create Product via BFF:
```
curl -X POST http://natenadze1102-bff-api-production.eu-central-1.elasticbeanstalk.com/product/products -H "Content-Type: application/json" -d '{"title":"New Product","description":"Product description","price":19.99,"count":10}'
```

### Cart Service Examples

#### Direct call to Cart Service:
```
curl https://ensi2pfsd7.execute-api.eu-central-1.amazonaws.com/prod/api/cart
```

#### Call via BFF Service:
```
curl http://natenadze1102-bff-api-production.eu-central-1.elasticbeanstalk.com/cart
```

## Caching Implementation

The BFF service implements caching for the product list endpoint:
- Cache expires after 2 minutes (120,000 ms)
- When a new product is created, it won't appear in the cached response until the cache expires
- After cache expiration, the new product will be visible in the response

To test caching:
1. Get products list via BFF
2. Create a new product directly through Product Service
3. Get products list via BFF again (won't show the new product)
4. Wait more than 2 minutes
5. Get products list via BFF again (will now include the new product)

## Additional Notes

- BFF Service is built using pure Node.js HTTP module (no Express as required)
- The service follows the architecture provided in the task requirements
- Environment variables are used to configure service URLs
- Proper error handling is implemented with status code forwarding
