const Command = require('commander').Command;
const meta = require('../package.json');

/*
 * A set of regex and simple helpers.
 */
const trueFalse = /^(true|false)$/;
const media = /^(print|screen)$/;
const format = /^(Letter|Legal|Tabloid|Ledger|A0|A1|A2|A3|A4|A5)$/;
const unit = /^[0-9.]+(px|in|cm|mm)$/;
const range = /^[0-9]+-?[0-9]*$/;
const integer = /[0-9]+/;
const toTrue = () => true;
const parseBool = (str) => 'true' === str ? true : false;

/**
 * Convert a commandline interface to a useable config object.
 */
class Config {
  /**
   * @constructor
   *
   * @param {string[]} argv The commandline arguments
   */
  constructor(argv) {
    /**
     * All the passed commandline arguments.
     * @type {string[]}
     */
    this.argv = argv;

    /**
     * Holds a number of processing errors.
     * If this array length is zero at the end,
     * then there were no processing errors.
     * @type {Error[]}
     */
    this.errors = [];

    /**
     * The parse configuration hash.
     * @type {object}
     */
    this.hash = {};

    /**
     * The commander instance.
     * @type {object}
     */
    this.parser = this.configureParser(new Command());
  }

  /**
   * A little regex validation helper which performs regex
   * test on a given value and prints out possible values
   * or the whole regex to help the user.
   *
   * @param {string} option The option name
   * @param {RegExp} regex The regex object
   * @returns {Function} Function for commander coercion
   */
  regex(option, regex) {
    return (value) => {
      // Early exit good values
      if (regex.test(value)) {
        return value;
      }

      // Print out possible values or the regex itself
      let r = regex.toString().replace('/^', '').replace('$/i', '');
      if (/^\(.*\)$/i.test(r)) {
        r = r.replace(/^\(|\)$/i, '').split('|');
        this.errors.push(new Error(
          '--' + option + ' - possible values: ' + r.join(', ')
        ));
        return null;
      }

      this.errors.push(new Error('--' + option + ' - pattern: ' + regex));
      return null;
    };
  }

  /**
   * Configure a given Commander instance.
   *
   * @param {object} program A commander instance
   * @returns {object} The given configured commander instance
   */
  configureParser(program) {
    return program
      .description(meta.description + '{{ARGS}}')
      .arguments('<URL> <DEST>')
      .option('-V, --version', 'Output the version number.', toTrue, false)
      .option('-h, --help', 'Output usage information.', toTrue, false)
      .option('-t, --network-timeout <integer>',
              'A timeout to wait before completing navigation in ms.',
              this.regex('network-timeout', integer),
              '1000')
      .option('-m, --media <string>',
              'Changes the CSS media type of the page.',
              this.regex('media', media),
              'screen')
      .option('-l, --landscape <boolean>',
              'Paper orientation.',
              this.regex('landscape', trueFalse),
              'false')
      .option('-h, --header-footer <boolean>',
              'Display header and footer.',
              this.regex('header-footer', trueFalse),
              'false')
      .option('-b, --background <boolean>',
              'Print background graphics.',
              this.regex('background', trueFalse),
              'true')
      .option('-s, --scale <integer>',
              'Scale of the webpage rendering.',
              this.regex('scale', integer),
              '1')
      .option('-r, --range <string>',
              'Paper ranges to print, e.g., "1-5, 8". ' +
                'Default prints all pages.',
              this.regex('range', range),
              '')
      .option('-f, --format <string>',
              'Paper format. If set, takes priority over ' +
                'width or height options.',
              this.regex('format', format),
              'A4')
      .option('--width <string>',
              'Paper width, accepts values labeled with units.',
              this.regex('width', unit))
      .option('--height <string>',
              'Paper height, accepts values labeled with units.',
              this.regex('height', unit))
      .option('--margin-top <string>',
              'Top margin, accepts values labeled with units.',
              this.regex('margin-top', unit),
              '0')
      .option('--margin-right <string>',
              'Right margin, accepts values labeled with units.',
              this.regex('margin-right', unit),
              '0')
      .option('--margin-bottom <string>',
              'Bottom margin, accepts values labeled with units.',
              this.regex('margin-bottom', unit),
              '0')
      .option('--margin-left <string>',
              'Left margin, accepts values labeled with units.',
              this.regex('margin-left', unit),
              '0')
      .action((url, dest) => {
        program.url = url;
        program.dest = dest;
      });
  }

  /**
   * Parse the given configuration.
   *
   * @returns {Promise}
   */
  parse() {
    // Utilize Commander for this job
    this.parser.parse(this.argv);

    // Map all the options
    let hash = {
      // Meta Flags
      version: true === this.parser['version'],
      help: true === this.parser['help'],
      args: this.parser['args'].length > 0,

      // Global Options
      url: this.parser['url'] || null,
      media: this.parser['media'] || null,
      networkTimeout: parseInt(this.parser['networkTimeout']),

      // PDF Options
      pdf: {
        path: this.parser['dest'] || null,
        landscape: parseBool(this.parser['landscape']),
        displayHeaderFooter: parseBool(this.parser['headerFooter']),
        printBackground: parseBool(this.parser['background']),
        scale: parseInt(this.parser['scale']),
        pageRanges: this.parser['range'],
        format: this.parser['format'],
        width: this.parser['width'],
        height: this.parser['height'],
        margin: {
          top: this.parser['marginTop'] || '0',
          right: this.parser['marginRight'] || '0',
          bottom: this.parser['marginBottom'] || '0',
          left: this.parser['marginLeft'] || '0'
        }
      }
    };

    // Strip off undefined values - the hard way
    // We use JSON here, because it can't represent
    // undefined values and the keys are stripped off.
    this.hash = JSON.parse(JSON.stringify(hash));

    // Return a fancy promise
    return new Promise((resolve, reject) => {
      if (this.errors.length) { return reject(this.errors); }
      resolve(this.hash);
    });
  }

  /**
   * Delivers the help of the commandline interface.
   *
   * @return {Promise} The output promise
   */
  help() {
    return new Promise((resolve) => {
      this.parser.outputHelp(function(output) {

        // Fix the help description
        output = output.replace('output usage information',
                                'Output usage information.');

        // Add arguments description
        output = output.replace('{{ARGS}}\n', [
          '',
          '',
          '  Arguments:',
          '',
          '    URL                  The URL (with protocol) to visit.',
          '    DEST                 The file path to save the PDF to.'
        ].join('\n'));

        // Add some appendix information
        output = output.replace(/$/, [
          '',
          '  Additional information:',
          '',
          '    All possible units are:',
          '',
          '      px - pixel           in - inch',
          '      cm - centimeter      mm - millimeter',
          '',
          '    The format options are:',
          '',
          '      Letter: 8.5in x 11in    Legal: 8.5in x 14in',
          '      Tabloid: 11in x 17in    Ledger: 17in x 11in',
          '      A0: 33.1in x 46.8in     A1: 23.4in x 33.1in',
          '      A2: 16.5in x 23.4in     A3: 11.7in x 16.5in',
          '      A4: 8.27in x 11.7in     A5: 5.83in x 8.27in',
        ].join('\n'));

        // Call the given callback
        resolve(output);

        // Play ticks on Commander
        return '';
      });
    });
  }
};

module.exports = Config;
