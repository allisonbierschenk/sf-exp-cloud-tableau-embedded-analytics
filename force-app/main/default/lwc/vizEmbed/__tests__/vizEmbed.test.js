import VizEmbed from 'c/vizEmbed';

describe('c-viz-embed', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders without crashing', () => {
        // Arrange
        const element = document.createElement('c-viz-embed');

        // Act
        document.body.appendChild(element);

        // Assert
        expect(document.body.contains(element)).toBe(true);
    });
});
