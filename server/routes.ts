import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Friending, Posting, Project, ProjectMember, Sessioning, Task, TaskAssignee } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";
import { NotAllowedError } from "./concepts/errors";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  /**
   * create project
   * creator will be current session user with given name
   * name must be unique
   */
  @Router.post("/projects")
  async createProject(session: SessionDoc, name: string) {
    const user = Sessioning.getUser(session);
    // get the project
    const project = (await Project.create(user, name)).project;
    // add creator as a member for that project
    if (project) {
      await ProjectMember.addGroupItem(project._id, user);
    }

    return { msg: "Successfully created project!", project: project };
  }

  /**
   * delete project
   * only the creator of the project can delete the project
   */
  @Router.delete("/projects/:id")
  async deleteProject(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(id);
    // only the creator should be able to delete the project
    await Project.assertUserIsCreator(projectId, user);
    await ProjectMember.deleteAllItemsInGroup(projectId);

    // delete all task-assignee linkages associated with tasks
    // get tasks for project
    const projectTasks = await Task.getAllTasksForProject(projectId);
    if (projectTasks) {
      // if there are tasks, then we iterate through task-assignee linakges for those tasks
      for (let i = 0; i < projectTasks.length; i++) {
        const task = projectTasks[i];
        const taskId = task._id;
        // remove all assignee linkages to that task (i.e. delete the task)
        await TaskAssignee.deleteAllItemsInGroup(taskId);
      }
    }

    // delete all tasks associated with the project
    await Task.deleteTasksForProject(projectId);
    return await Project.deleteProject(projectId);
  }

  /**
   * get project given either a name or ID
   */
  @Router.get("/projects")
  async getProject(session: SessionDoc, name?: string, id?: string) {
    const user = Sessioning.getUser(session);
    let project;
    let projectId;
    if (id) {
      projectId = new ObjectId(id);
      await ProjectMember.assertItemInGroup(projectId, user);
      project = await Project.getProject(projectId);
    } else if (name) {
      project = await Project.getProjectByName(name);
    } else {
      throw new NotAllowedError("Did not specify project to fetch!");
    }
    return project;
  }

  /**
   * get projects that a user is a part of
   */
  @Router.get("/user/projects")
  async getUserProjects(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await ProjectMember.getGroupsForItem(user);
  }

  /**
   * update project name
   * only creator of project can change project
   */
  @Router.patch("/project/name")
  async updateProjectName(session: SessionDoc, id: string, name: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(id);
    // only the creator should be able to update project anme
    await Project.assertUserIsCreator(projectId, user);

    return await Project.updateProjectName(projectId, name);
  }

  /**
   * update project manager
   * only creator of project can change project
   * only other members of the project can be assigned as the new manager
   */
  @Router.patch("/project/manager")
  async updateProjectManager(session: SessionDoc, id: string, manager: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(id);
    // only the creator should be able to update project anme
    await Project.assertUserIsCreator(projectId, user);

    const managerId = new ObjectId(manager);
    // new manager must already be a member of the project
    await ProjectMember.assertItemInGroup(projectId, managerId);
    return await Project.updateProjectCreator(projectId, managerId);
  }

  /**
   * add a member to a project
   * only creator of project can add a member to the project
   */
  @Router.post("/project/members")
  async addMemberToProject(session: SessionDoc, id: string, member: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(id);
    const newMember = new ObjectId(member);

    await Project.assertUserIsCreator(projectId, user);
    return await ProjectMember.addGroupItem(projectId, newMember);
  }

  /**
   * delete a member from a project
   * only creator of project can delete a member from the project
   */
  @Router.delete("/project/members")
  async deleteMemberFromProject(session: SessionDoc, id: string, member: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(id);
    const memberToDelete = new ObjectId(member);

    await Project.assertUserIsCreator(projectId, user);

    // remove member as an assignee from all tasks it is a part of
    await TaskAssignee.deleteItemFromAllGroups(memberToDelete);

    return await ProjectMember.removeGroupItem(projectId, memberToDelete);
  }

  /**
   * get all members in a project
   */
  @Router.get("/project/members")
  async getAllMembersInProject(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(id);

    await ProjectMember.assertItemInGroup(projectId, user);

    return await ProjectMember.getItemsInGroup(projectId);
  }

  /**
   * create task
   * only project manager can create tasks for that project
   * TODO: linking functionality? do we add a generic "comments" field that just takes longer string input?
   * TODO: consider if we should limit the task description length (ex: 100 characters), then have extra "comments"
   * box for more detail
   */
  @Router.post("/project/tasks")
  async createTask(session: SessionDoc, project: string, description: string, assignee?: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(project);

    await Project.assertUserIsCreator(projectId, user);
    const task = await Task.create(description, projectId);
    let assigneeId;
    if (assignee) {
      assigneeId = new ObjectId(assignee);
      // assert that the user assigned is actually a member of the project
      await ProjectMember.assertItemInGroup(projectId, assigneeId);
      if (!task.task) {
        throw new NotAllowedError("Task not successfully created!");
      }
      await TaskAssignee.addGroupItem(task.task._id, assigneeId);
    }

    return task;
  }

  /**
   * delete task
   * only project manager can delete tasks for that project
   */
  @Router.delete("/project/tasks/:id")
  async deleteTask(session: SessionDoc, task: string) {
    const user = Sessioning.getUser(session);
    const taskId = new ObjectId(task);

    const projectId = (await Task.getTask(taskId))?.project;
    if (!projectId) {
      throw new NotAllowedError("Task does not exist!");
    }
    await Project.assertUserIsCreator(projectId, user);

    // remove all instances of task-assignee links
    await TaskAssignee.deleteAllItemsInGroup(taskId);

    await Task.delete(taskId);
  }

  /**
   * get all tasks for a project
   * only project members are able to see the tasks for a project
   */
  @Router.get("/project/tasks")
  async getTasksForProject(session: SessionDoc, project: string) {
    const user = Sessioning.getUser(session);
    const projectId = new ObjectId(project);

    await ProjectMember.assertItemInGroup(projectId, user);

    return await Task.getAllTasksForProject(projectId);
  }

  /**
   * get all tasks for a user
   * current user can only see their own tasks
   */
  @Router.get("/user/tasks")
  async getTasksForUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);

    // should return all tasks associated with user
    return await TaskAssignee.getGroupsForItem(user);
  }

  /**
   * update task description
   * only project manager can update details for a project's tasks
   */
  @Router.patch("/project/task/description")
  async updateTaskDescription(session: SessionDoc, task: string, description: string) {
    const user = Sessioning.getUser(session);
    const taskId = new ObjectId(task);

    const projectId = (await Task.getTask(taskId))?.project;
    if (!projectId) {
      throw new NotAllowedError("Task does not exist!");
    }
    await Project.assertUserIsCreator(projectId, user);

    await Task.updateDescription(taskId, description);
  }

  /**
   * update the user that the task is assigned to
   * only manager of the project for that task can do this
   * this should be called if a user is being added to a task
   *
   * IMPORTANT: call unassignTask() first before adding task assignees
   * in order to fully reassign task, else will just keep adding assignees
   */
  @Router.post("/project/task/assignees")
  async addTaskAssignee(session: SessionDoc, task: string, assignee: string) {
    const user = Sessioning.getUser(session);
    const taskId = new ObjectId(task);

    // get project id of the task to check if user is creator of project
    const projectId = (await Task.getTask(taskId))?.project;
    if (!projectId) {
      throw new NotAllowedError("Task does not exist!");
    }
    await Project.assertUserIsCreator(projectId, user);

    // set user as new assignee
    const assigneeId = new ObjectId(assignee);
    return await TaskAssignee.addGroupItem(taskId, assigneeId);
  }

  /**
   * unassign task
   * only manager of the project for that task can do this
   */
  @Router.delete("/project/task/assignees")
  async unassignTask(session: SessionDoc, task: string) {
    const user = Sessioning.getUser(session);
    const taskId = new ObjectId(task);

    const projectId = (await Task.getTask(taskId))?.project;
    if (!projectId) {
      throw new NotAllowedError("Task does not exist!");
    }
    await Project.assertUserIsCreator(projectId, user);

    // deletes all task-assignee linkages for that task
    return await TaskAssignee.deleteAllItemsInGroup(taskId);
  }

  /**
   * get assignees for a task
   * only members of a project can do this
   */
  @Router.get("/project/task/assignees")
  async getAssigneesForTask(session: SessionDoc, task: string) {
    const user = Sessioning.getUser(session);
    const taskId = new ObjectId(task);

    const projectId = (await Task.getTask(taskId))?.project;
    if (!projectId) {
      throw new NotAllowedError("Task does not exist!");
    }
    await ProjectMember.assertItemInGroup(projectId, user);

    // gets all task-assignee linkages for that task
    return await TaskAssignee.getItemsInGroup(taskId);
  }

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
