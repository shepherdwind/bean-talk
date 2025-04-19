/**
 * A simple dependency injection container
 */

export type Factory<T> = () => T;
export type Constructor<T> = new (...args: any[]) => T;

export class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();
  private factories: Map<string, Factory<any>> = new Map();

  private constructor() {}

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a service instance with the container using its class constructor
   * @param constructor The class constructor to use as identifier
   * @param instance The service instance
   */
  public registerClass<T>(constructor: Constructor<T>, instance: T): void {
    this.services.set(constructor.name, instance);
  }

  /**
   * Register a factory function to create a service on demand using its class constructor
   * @param constructor The class constructor to use as identifier
   * @param factory A function that creates the service instance
   */
  public registerClassFactory<T>(constructor: Constructor<T>, factory: Factory<T>): void {
    this.factories.set(constructor.name, factory);
  }

  /**
   * Get a service instance by its class name
   * If the service is not yet instantiated but has a factory, it will be created
   * @param className The name of the class to retrieve
   * @returns The service instance
   */
  private getByClassName<T>(className: string): T {
    // If service exists, return it
    if (this.services.has(className)) {
      return this.services.get(className) as T;
    }
    
    // If a factory exists, create the service and store it
    if (this.factories.has(className)) {
      const factory = this.factories.get(className)!;
      const instance = factory();
      this.services.set(className, instance);
      return instance as T;
    }
    
    throw new Error(`Service '${className}' not found in the container`);
  }

  /**
   * Get a service instance by its class constructor
   * @param constructor The class constructor of the service to retrieve
   * @returns The service instance
   */
  public getByClass<T>(constructor: Constructor<T>): T {
    return this.getByClassName<T>(constructor.name);
  }

  /**
   * Check if a service exists in the container by its class constructor
   * @param constructor The class constructor of the service
   * @returns True if the service exists, false otherwise
   */
  public hasClass<T>(constructor: Constructor<T>): boolean {
    return this.services.has(constructor.name) || this.factories.has(constructor.name);
  }

  /**
   * Remove a service from the container by its class constructor
   * @param constructor The class constructor of the service
   */
  public removeClass<T>(constructor: Constructor<T>): void {
    this.services.delete(constructor.name);
    this.factories.delete(constructor.name);
  }

  /**
   * Clear all services and factories from the container
   */
  public clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

// Singleton instance for direct import
export const container = Container.getInstance();