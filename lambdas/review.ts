import { Handler } from "aws-lambda";

export const handler: Handler = async (event, context) => {
  try {
    console.log("Someone called me out.");
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: { message: "This is the message that the lambda function returned." },
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};