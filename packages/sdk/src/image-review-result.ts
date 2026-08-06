import type { MynthSDKTypes } from "./types";

/**
 * Represents the result of a completed image quality review task.
 */
export class ImageReviewResult {
  /** The task ID created for this review request */
  public readonly taskId: string;

  /** Cost charged for the completed task */
  public readonly cost: string;

  /** The submitted image URL */
  public readonly url: string;

  /** Median reviewer score from 1 to 4. Higher is better. */
  public readonly score: number;

  /** Review summary */
  public readonly summary: string;

  /** Defects found by the reviewer panel */
  public readonly findings: MynthSDKTypes.ImageReviewFinding[];

  /** Strengths identified by the reviewer panel */
  public readonly strengths: MynthSDKTypes.ImageReviewStrength[];

  constructor(data: {
    taskId: string;
    cost: string;
    url: string;
    score: number;
    summary: string;
    findings: MynthSDKTypes.ImageReviewFinding[];
    strengths: MynthSDKTypes.ImageReviewStrength[];
  }) {
    this.taskId = data.taskId;
    this.cost = data.cost;
    this.url = data.url;
    this.score = data.score;
    this.summary = data.summary;
    this.findings = data.findings;
    this.strengths = data.strengths;
  }

  static fromTaskData(data: MynthSDKTypes.ImageReviewTaskData): ImageReviewResult {
    if (data.status !== "completed" || data.result === null) {
      throw new Error(`Image review task ${data.id} is not completed`);
    }

    if (data.cost === null) {
      throw new Error(`Image review task ${data.id} is missing cost`);
    }

    return new ImageReviewResult({
      taskId: data.id,
      cost: data.cost,
      ...data.result,
    });
  }
}
