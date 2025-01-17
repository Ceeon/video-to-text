declare module '@gradio/client' {
  interface PredictResult {
    data: any[];
  }

  interface GradioClient {
    predict(fn_index: number, args: any[]): Promise<PredictResult>;
  }

  export function client(space: string): Promise<GradioClient>;
} 