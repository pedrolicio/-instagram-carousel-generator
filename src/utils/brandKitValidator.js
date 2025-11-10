const requiredPaths = [
  'clientName',
  'brandIdentity.colors.primary',
  'brandIdentity.colors.secondary',
  'brandIdentity.colors.accent',
  'brandIdentity.colors.background',
  'brandIdentity.colors.text',
  'brandIdentity.visualStyle.type',
  'brandIdentity.visualStyle.mood',
  'brandIdentity.visualStyle.imageStyle',
  'brandIdentity.visualStyle.composition',
  'brandIdentity.typography.style',
  'brandIdentity.typography.hierarchy',
  'brandIdentity.visualElements.preferredLayout',
  'communication.tone',
  'communication.language',
  'communication.formality',
  'communication.targetAudience.profile'
];

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

  if (brandKit?.communication?.characteristics?.length === 0) {
    errors['communication.characteristics'] = 'Informe pelo menos uma característica';
  }

  if (brandKit?.communication?.contentThemes?.length === 0) {
    errors['communication.contentThemes'] = 'Informe pelo menos um tema de conteúdo';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const getErrorForPath = (errors, path) => errors[path];
