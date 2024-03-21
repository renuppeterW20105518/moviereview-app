import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient,QueryCommand,QueryCommandInput,} from "@aws-sdk/lib-dynamodb";


const ddbDocClient = createDdbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event Start: ", event);
    
    const parameters = event?.pathParameters;
    const MovieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    const ReviewerName = parameters?.reviewerName;

    if (!MovieId) {
        return {
            statusCode: 404,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ Message: "This movie id is missing" }),
        };
    }

    let commandInput: QueryCommandInput;
    if (ReviewerName && isNaN(parseInt(ReviewerName))) {
        commandInput = {
          TableName: process.env.TABLE_NAME,
          IndexName: "reviewerIndex",
          KeyConditionExpression: "MovieId = :m and ReviewerName = :r",
          ExpressionAttributeValues: {
            ":m": MovieId,
            ":r": ReviewerName,
          },
        };
      } else if (ReviewerName && !isNaN(parseInt(ReviewerName))) {
        commandInput = {
          TableName: process.env.TABLE_NAME,
          IndexName: "reviewDateIndex",
          KeyConditionExpression: "MovieId = :m and begins_with(ReviewDate, :r)",
          ExpressionAttributeValues: {
            ":m": MovieId,
            ":r": ReviewerName,
          },
        };
    } else {
        return {
          statusCode: 400,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: "This reviewer name or year is missing",
          }),
        };
      }

    const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));

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
    } catch (error: any) {
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
