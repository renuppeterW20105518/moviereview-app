import { marshall } from "@aws-sdk/util-dynamodb";
import { MovieReviews,MovieReviewMemberQueryParams } from "./types";

type Entity = MovieReviews | MovieReviewMemberQueryParams;

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