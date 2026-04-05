import { Container } from '../container';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    // Get the singleton and clear it
    container = Container.getInstance();
    container.clear();
  });

  afterEach(() => {
    container.clear();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      expect(Container.getInstance()).toBe(Container.getInstance());
    });
  });

  describe('registerClass / getByClass', () => {
    it('should register and retrieve a service instance', () => {
      class MyService {}
      const instance = new MyService();
      container.registerClass(MyService, instance);
      expect(container.getByClass(MyService)).toBe(instance);
    });

    it('should throw when service not found', () => {
      class Unknown {}
      expect(() => container.getByClass(Unknown)).toThrow(
        "Service 'Unknown' not found in the container"
      );
    });
  });

  describe('registerClassFactory', () => {
    it('should create service lazily on first getByClass call', () => {
      class LazyService {
        public value = 'created';
      }
      const factory = jest.fn(() => new LazyService());
      container.registerClassFactory(LazyService, factory);

      expect(factory).not.toHaveBeenCalled();

      const instance = container.getByClass(LazyService);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(instance.value).toBe('created');
    });

    it('should cache the instance after first creation', () => {
      class CachedService {}
      const factory = jest.fn(() => new CachedService());
      container.registerClassFactory(CachedService, factory);

      const first = container.getByClass(CachedService);
      const second = container.getByClass(CachedService);
      expect(first).toBe(second);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasClass', () => {
    it('should return true for registered instance', () => {
      class Svc {}
      container.registerClass(Svc, new Svc());
      expect(container.hasClass(Svc)).toBe(true);
    });

    it('should return true for registered factory', () => {
      class Svc {}
      container.registerClassFactory(Svc, () => new Svc());
      expect(container.hasClass(Svc)).toBe(true);
    });

    it('should return false for unregistered service', () => {
      class Svc {}
      expect(container.hasClass(Svc)).toBe(false);
    });
  });

  describe('removeClass', () => {
    it('should remove both instance and factory', () => {
      class Svc {}
      container.registerClass(Svc, new Svc());
      container.removeClass(Svc);
      expect(container.hasClass(Svc)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all services', () => {
      class A {}
      class B {}
      container.registerClass(A, new A());
      container.registerClassFactory(B, () => new B());

      container.clear();
      expect(container.hasClass(A)).toBe(false);
      expect(container.hasClass(B)).toBe(false);
    });
  });
});
