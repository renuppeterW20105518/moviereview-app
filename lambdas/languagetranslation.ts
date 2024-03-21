import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import { TranslateClient, TranslateTextCommand, } from "@aws-sdk/client-translate";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["LanguageMemberQueryParams"] || {}
);

const ddbDocClient = createDdbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event Start: ", event);
    const parameters = event?.pathParameters;
    const queryParams = event.queryStringParameters || {};

    if ( !parameters || !parameters.reviewerName || !parameters.movieId || !queryParams.language) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json",},
        body: JSON.stringify({ message: "The required parameters are missing" }),
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
            schema: schema.definitions["LanguageMemberQueryParams"],
          }),
        };
      }

    const MovieId = parseInt(parameters.movieId);
    const ReviewerName = parameters.reviewerName;
    const Language = queryParams.language;

    const commandOutput = await ddbDocClient.send(
        new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "MovieId = :m and ReviewerName = :r",//Table name 
            ExpressionAttributeValues: {
                ":m": MovieId,
                ":r": ReviewerName,
            },
        })
    );

    console.log('QueryCommand response: ', commandOutput);

    if (!commandOutput.Items || commandOutput.Items.length === 0) {
        return {
            statusCode: 404,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ Message: "No reviews found for this movie id" }),
        };
    }

    const content = commandOutput.Items[0].content;
    const translate = {
      Text: content,
      SourceLanguageCode: "en",
      TargetLanguageCode: Language,
    };

    const transClient = new TranslateClient({ region: process.env.REGION });
    const transText = await transClient.send( new TranslateTextCommand(translate));
    const body = transText.TranslatedText;

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: body,
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
