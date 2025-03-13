# AWS Back Project

This repository contains the backend microservices for the project. The backend is implemented using AWS CDK, AWS Lambda, and AWS API Gateway. It includes the following services:

- **Product Service**: Manages product-related endpoints.
- **Import Service**: (If applicable) Handles the importing of product data.
- **Authorization Service**: (If applicable) Manages user authentication and authorization.

---

## Project Structure

```plaintext
cdk-ts/
├── authorization_service   # Authentication/authorization microservice repository
├── import_service          # Service for importing product data
├── product_service         # Service for product data management
│   ├── src/                # Source code for Lambda functions
│   ├── __test__/           # Unit tests for Lambda functions
│   ├── openapi.yaml        # Swagger documentation for Product Service
│   └── cdk/                # AWS CDK configuration and stack definitions
├── package.json            # Project-level configuration
└── README.md               # This documentation file
```
