/**
 * MessageInputComponent - Responsible for handling message input
 * Following the Single Responsibility Principle, this component is only responsible
 * for handling message input.
 */
export class MessageInputComponent {
  private form: HTMLFormElement;
  private input: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private sendHandlers: ((message: string) => void)[] = [];
  
  constructor(formId: string, inputId: string, buttonId: string) {
    // Get the form element
    const formElement = document.getElementById(formId);
    if (!formElement || !(formElement instanceof HTMLFormElement)) {
      throw new Error(`Form with ID ${formId} not found`);
    }
    this.form = formElement;
    
    // Get the input element
    const inputElement = document.getElementById(inputId);
    if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
      throw new Error(`Input with ID ${inputId} not found`);
    }
    this.input = inputElement;
    
    // Get the button element
    const buttonElement = document.getElementById(buttonId);
    if (!buttonElement || !(buttonElement instanceof HTMLButtonElement)) {
      throw new Error(`Button with ID ${buttonId} not found`);
    }
    this.submitButton = buttonElement;
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Handle form submission
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.sendMessage();
    });
    
    // Handle button click
    this.submitButton.addEventListener('click', () => {
      this.sendMessage();
    });
    
    // Handle Enter key
    this.input.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });
  }
  
  /**
   * Send a message
   */
  private sendMessage(): void {
    const message = this.input.value.trim();
    if (message) {
      this.notifySendHandlers(message);
      this.input.value = '';
    }
    
    // Focus the input field
    this.input.focus();
  }
  
  /**
   * Add a send handler
   */
  public onSend(handler: (message: string) => void): void {
    this.sendHandlers.push(handler);
  }
  
  /**
   * Notify all send handlers
   */
  private notifySendHandlers(message: string): void {
    this.sendHandlers.forEach(handler => handler(message));
  }
  
  /**
   * Set the enabled state of the input
   */
  public setEnabled(enabled: boolean): void {
    this.input.disabled = !enabled;
    this.submitButton.disabled = !enabled;
  }
}
