export const siteCopy = {
  brandSubtitle: "Clear answers from real people",
  nav: {
    home: "Home",
    feed: "Questions",
    account: "My profile",
    testing: "Try demo"
  },
  actions: {
    askCrowd: "Ask a question",
    seeQuestions: "See questions",
    joinCrowd: "Join"
  }
};

export function splitCamel(value?: string | null) {
  if (!value) return "";
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function publicRoleLabel(role?: string | null) {
  if (role === "Owner") return "Community lead";
  if (role === "Moderator") return "Community guide";
  if (role === "Member") return "Member";
  if (role === "Visitor") return "Guest";
  return role ?? "Guest";
}

export function publicAuthorityLabel(authorityLevel?: string | null) {
  if (authorityLevel === "Advisory") return "Community signal";
  if (authorityLevel === "Recognized") return "Guides a real next step";
  if (authorityLevel === "Binding") return "Committed decision";
  return authorityLevel ? splitCamel(authorityLevel) : "Community signal";
}

export function publicQuestionStatus(status?: string | null) {
  if (status === "Submitted") return "Ready for review";
  if (status === "Challenged") return "Flagged for review";
  if (status === "Amendment") return "Needs clearer wording";
  if (status === "Accepted") return "Ready for voting";
  if (status === "Rejected") return "Not moving forward";
  if (status === "Archived") return "Saved for the record";
  if (status === "ResultPublished") return "Results posted";
  return status ? splitCamel(status) : "No question";
}

export function publicPollStatus(status?: string | null) {
  if (status === "Configured") return "Waiting for review";
  if (status === "Open") return "Voting open";
  if (status === "Closed") return "Counting votes";
  if (status === "ResultPublished") return "Results posted";
  if (status === "NotCreated") return "No voting yet";
  return status ? splitCamel(status) : "No voting yet";
}

export function publicDiscussionLabel(kind?: string | null) {
  if (kind === "ModeratorNote") return "Guide note";
  if (kind === "ClarifyingQuestion") return "Question";
  if (kind === "ProArgument") return "For";
  if (kind === "ConArgument") return "Against";
  return kind ? splitCamel(kind) : "Comment";
}
