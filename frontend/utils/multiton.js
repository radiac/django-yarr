/** Multiton class factory
    Turns a class constructor into a Multiton

    Call with an abstract class constructor
    Returns the constructor with a new .get() object method
    To get or create instance of class, call .get() with arguments;
    must pass at least one argument, which must be the key.
    All arguments are then passed on to the constructor.
*/
export const multiton = (cls) => {
  // Somewhere to store instances
  let registry = {};

  // A wrapper class to pass arbitrary arguments on to the constructor
  function Cls(args) {
    return cls.apply(this, args);
  }

  cls.get = function (key) {
    // Copy across prototype in case it has changed
    Cls.prototype = cls.prototype;

    // Instantiate if necessary
    if (!(key in registry)) {
      registry[key] = new Cls(arguments);
    }
    return registry[key];
  };
  return cls;
};
