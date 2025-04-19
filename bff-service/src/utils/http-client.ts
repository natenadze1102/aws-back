import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

interface RequestOptions {
  method: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
}

export async function makeRequest(
  url: string,
  options: RequestOptions
): Promise<AxiosResponse> {
  const config: AxiosRequestConfig = {
    url,
    method: options.method as any,
    headers: options.headers || {},
    data: options.data,
    timeout: options.timeout || 30000, // Default timeout: 30 seconds
    validateStatus: () => true, // Don't throw error on any status code
  };

  try {
    return await axios(config);
  } catch (error) {
    console.error('Request error:', error);
    throw error;
  }
}
