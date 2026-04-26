import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { StateAnnotation, type AppState } from "./state";
import { researcherNode } from "./nodes/researcher";
import { criticNode } from "./nodes/critic";
import { synthesizerNode } from "./nodes/synthesizer";

function dispatchCritics(state: AppState): Send[] | "synthesizer" | typeof END {
  if (state.error) return END;
  if (state.researcherFindings.length === 0) return "synthesizer";
  return state.researcherFindings.map(
    (issue) => new Send("critic", { issue })
  );
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("researcher", researcherNode)
  // criticNode receives Send-dispatched single-issue input, not full AppState.
  .addNode("critic", criticNode as unknown as typeof researcherNode)
  .addNode("synthesizer", synthesizerNode)
  .addEdge(START, "researcher")
  .addConditionalEdges("researcher", dispatchCritics, ["critic", "synthesizer", END])
  .addEdge("critic", "synthesizer")
  .addEdge("synthesizer", END);

export const graph = workflow.compile();
