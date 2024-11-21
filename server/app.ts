import AuthenticatingConcept from "./concepts/authenticating";
import FriendingConcept from "./concepts/friending";
import GroupItemConcept from "./concepts/grouping";
import PostingConcept from "./concepts/posting";
import ProjectConcept from "./concepts/projects";
import SessioningConcept from "./concepts/sessioning";
import TaskingConcept from "./concepts/tasking";

// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");

export const Project = new ProjectConcept("projects");
export const ProjectMember = new GroupItemConcept("projectmembers");

// task stores description, associated project, and completion
export const Task = new TaskingConcept("tasks");
// TODO: linking functionality?
// export const TaskLink = new GroupItemConcept("tasklink");
