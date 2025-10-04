import {
  Langfuse,
  LangfuseTraceClient,
  LangfuseSpanClient,
  LangfuseGenerationClient,
} from "langfuse";
import type {
  ChatCompletionMessageParam,
  ChatCompletion,
} from "openai/resources/chat/completions";
import { v4 as uuidv4 } from "uuid";

export { LangfuseTraceClient } from "langfuse-core";

export class LangfuseService {
  public langfuse: Langfuse;

  constructor() {
    this.langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });

    this.langfuse.on("error", (error: Error) => {
      console.error("Langfuse error:", error);
    });

    if (process.env.NODE_ENV === "development") {
      this.langfuse.debug();
    }
  }

    async createSession(
    sessionNamePrefix: string,
    sessionId: string = uuidv4()
  ): Promise<{ traceClient: LangfuseTraceClient, sessionId: string}> {
    const sessionName = `${sessionNamePrefix}-${sessionId}`
    console.log(`Creating session with a sessionId: ${sessionName}"`);
    const trace = this.langfuse.trace({ sessionId: sessionName });
    await this.langfuse.flushAsync();

    return { traceClient: trace, sessionId: sessionName };
  }

  async createTrace(
    sessionId: string,
    name: string,
    input?: any,
    id: string = uuidv4(),
  ): Promise<LangfuseTraceClient> {
    console.log(`Creating trace '${name}' with an id: ${id} and sessionId:${sessionId}"`);
    const trace = this.langfuse.trace({ id, name, sessionId, input });
    await this.langfuse.flushAsync();

    return trace;
  }

  async createCompletionTrace(
    sessionId: string,
    name: string,
    input: ChatCompletionMessageParam[],
    id: string = uuidv4(),
  ): Promise<LangfuseTraceClient> {
    return await this.createTrace(sessionId, name, input, id);
  }

  async createSpan(trace: LangfuseTraceClient, name: string, input?: any): Promise<LangfuseSpanClient> {
    console.log(`Creating span '${name}' for trace with an id: ${trace.id}`);

    if (input)
    {
      console.log(`Span input: '${input}'`);
    }

    const span = trace.span({
      name,
      input,
      startTime: new Date(),
    });
    
    await this.langfuse.flushAsync();

    return span;
  }

  async createCompletionSpan(
    trace: LangfuseTraceClient,
    name: string,
    input: ChatCompletionMessageParam[]
  ): Promise<LangfuseSpanClient> {
    const jsonInput = input ? JSON.stringify(input) : undefined;
    
    console.log(`Creating completion span '${name}' for trace with an id: ${trace.id}`);
    console.log(`Completion span input: '${jsonInput}'`);
    return await this.createSpan(trace, name, input)
  }

  async finalizeCompletionSpan(
    span: LangfuseSpanClient,
    input: ChatCompletionMessageParam[],
    completionFunc: () => Promise<ChatCompletion>
  ): Promise<ChatCompletion> {
    const output = await completionFunc();
    let parsedOutput = JSON.stringify(output);
    
    console.log(`Finalising completion span '${span.span.name}' for trace with an id: ${span.traceId}`);
    if (
      output &&
      "choices" in output &&
      output.choices[0] &&
      output.choices[0].message &&
      typeof output.choices[0].message.content === "string"
    ) {
      parsedOutput = JSON.stringify(output.choices[0].message);
      span.update({
        output: JSON.stringify(output.choices[0].message),
      });
    } else {
      console.warn("Output does not contain expected structure:", output);
      span.update({
        output: JSON.stringify(output),
      });
    }

    
    console.log(`Completion span input: '${parsedOutput}'`);

    const generation: LangfuseGenerationClient = span.generation({
      name: span.span.name,
      model: output.model,
      modelParameters: {
        temperature: 0.7, // Add other parameters if available
      },
      input: input,
      output: output,
      usage: {
        promptTokens: output.usage?.prompt_tokens,
        completionTokens: output.usage?.completion_tokens,
        totalTokens: output.usage?.total_tokens,
      },
    });
    generation.end();

    span.update({
      endTime: new Date(),
    });

    span.end();
    await this.langfuse.flushAsync();
    return output;
  }

  async shutdownAsync(): Promise<void> {
    await this.langfuse.shutdownAsync();
  }
}
