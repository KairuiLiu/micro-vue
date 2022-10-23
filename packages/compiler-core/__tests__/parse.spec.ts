import { NodeTypes } from '../src/ast';
import { baseParse } from '../src/parse';

describe('Parse', () => {
  describe('inter', () => {
    test('inter', () => {
      const ast = baseParse('{{ message }}');
      expect(ast.children[0]).toStrictEqual({
        type: NodeTypes.INTERPOLATION,
        content: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'message',
        },
      });
    });
  });

  describe('element', () => {
    test('inter', () => {
      const ast = baseParse('<div></div>');
      expect(ast.children[0]).toStrictEqual({
        type: NodeTypes.ELEMENT,
        tag: 'div',
      });
    });
  });

  describe('text', () => {
    test('inter', () => {
      const ast = baseParse('bulabula');
      expect(ast.children[0]).toStrictEqual({
        type: NodeTypes.TEXT,
        content: 'bulabula',
      });
    });
  });
});
