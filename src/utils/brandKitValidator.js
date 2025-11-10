const requiredPaths = ['clientName', 'communication.tone', 'communication.language'];

const resolvePath = (object, path) =>
  path.split('.').reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), object);

export const validateBrandKit = (brandKit) => {
  const errors = {};

  requiredPaths.forEach((path) => {
    const value = resolvePath(brandKit, path);
    if (value === undefined || value === null || value === '') {
      errors[path] = 'Campo obrigatório';
    }
  });

  if (brandKit?.communication?.tone === 'custom') {
    const customTone = brandKit?.communication?.customTone;
    if (!customTone || customTone.trim() === '') {
      errors['communication.customTone'] = 'Descreva o tom personalizado';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const getErrorForPath = (errors, path) => errors[path];
