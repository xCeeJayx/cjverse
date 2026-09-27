export default [
  'packages/*',
  'apps/*',
  {
    test: {
      name: 'root',
      include: ['tests/**/*.test.ts'],
      exclude: ['superpowers-main/**', '**/node_modules/**']
    }
  }
];
