import { marshall } from "@aws-sdk/util-dynamodb";
import { MovieReview,MovieReviewMemberQueryParams } from "./types";

type Entity = MovieReview | MovieReviewMemberQueryParams;

export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
  });
};