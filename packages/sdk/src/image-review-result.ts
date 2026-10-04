import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed image quality review task.
 */
export type ImageReviewResult = {
  /** The task ID created for this review request */
  taskId: string;
  /** Cost charged for the completed task */
  cost: string;
  /** Median reviewer score from 1 to 4. Higher is better. */
  score: number;
  /** Review summary */
  summary: string;
  /** Defects found by the reviewer panel */
  findings: MynthSDKTypes.ImageReviewFinding[];
  /** Strengths identified by the reviewer panel */
  strengths: MynthSDKTypes.ImageReviewStrength[];
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: { request: MynthSDKTypes.ImageReviewRequest; result: MynthSDKTypes.ImageReviewTaskResult };
};

/** Map a completed image quality review task. */
export function toImageReviewResult(
  task: MynthCompletedTask<MynthSDKTypes.ImageReviewRequest, MynthSDKTypes.ImageReviewTaskResult>,
): ImageReviewResult {
  return {
    taskId: task.taskId,
    cost: task.cost,
    score: task.result.score,
    summary: task.result.summary,
    findings: task.result.findings,
    strengths: task.result.strengths,
    raw: { request: task.request, result: task.result },
  };
}
