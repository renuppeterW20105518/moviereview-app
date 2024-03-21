import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient,QueryCommand,QueryCommandInput,} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieReviewMemberQueryParams"] || {}
);
 
const ddbDocClient = createDdbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event Start: ", event);
    const queryParams = event.queryStringParameters || {};
    if (!queryParams) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }
    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
          schema: schema.definitions["MovieReviewMemberQueryParams"],
        }),
      };
    }
    
    const parameters = event?.pathParameters;
    const MovieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    const minRating = queryParams?.minRating ? parseInt(queryParams.minRating) : undefined;
    // if (minRating !== undefined && (minRating < 1 || minRating > 5)) {
    //   return {
    //     statusCode: 400,
    //     headers: {
    //       "content-type": "application/json",
    //     },
    //     body: JSON.stringify({ message: "Rating is in between 1 and 5" }),
    //   };
    // }
    

    let commandInput: QueryCommandInput = { TableName: process.env.TABLE_NAME,};
    if ("minRating" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "ratingIndex",
        KeyConditionExpression: "MovieId = :m and Rating > :r) ",
        ExpressionAttributeValues: {
          ":m": MovieId,
          ":r": minRating,
        },
      };
    } else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "MovieId = :m",
        ExpressionAttributeValues: {
          ":m": MovieId,
        },
      };
    }
    
    const commandOutput = await ddbDocClient.send( new QueryCommand(commandInput));
    
      console.log('QueryCommand response: ', commandOutput);
      
      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          data: commandOutput.Items,
        }),
      };
    } catch (error) {
      console.log(JSON.stringify(error));
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ error }),
      };
    }
  };
  
  function createDdbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}