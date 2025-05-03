import { User } from '../models/User';

/**
 * UserListComponent - Responsible for displaying the list of users
 * Following the Single Responsibility Principle, this component is only responsible
 * for displaying the list of users.
 */
export class UserListComponent {
  private container: HTMLElement;
  private users: Map<string, User> = new Map();
  
  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with ID ${containerId} not found`);
    }
    this.container = element;
  }
  
  /**
   * Add a user to the list
   */
  public addUser(user: User): void {
    if (user.name) {
      this.users.set(user.name, user);
      this.render();
    }
  }
  
  /**
   * Remove a user from the list
   */
  public removeUser(userName: string): void {
    if (this.users.has(userName)) {
      this.users.delete(userName);
      this.render();
    }
  }
  
  /**
   * Clear all users
   */
  public clearUsers(): void {
    this.users.clear();
    this.render();
  }
  
  /**
   * Render the user list
   */
  private render(): void {
    // Clear the container
    this.container.innerHTML = '';
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Create the header
    const header = document.createElement('div');
    header.className = 'user-list-header';
    header.textContent = 'Online Users';
    fragment.appendChild(header);
    
    // Create the list
    const list = document.createElement('ul');
    list.className = 'user-list';
    
    // Add each user to the list
    Array.from(this.users.values()).forEach(user => {
      const userElement = document.createElement('li');
      userElement.className = 'user-item';
      if (user.isCurrentUser) {
        userElement.classList.add('current-user');
      }
      
      userElement.textContent = user.name;
      list.appendChild(userElement);
    });
    
    fragment.appendChild(list);
    
    // Add the fragment to the container
    this.container.appendChild(fragment);
  }
}
