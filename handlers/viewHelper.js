const fs       = require('fs')
const path     = require('path')
const Mustache = require('../libs/mustache/mustache')

const __viewpath = path.resolve(__dirname, '..', 'views')

function getContent(view, extension) {
  try{
    return fs.readFileSync(path.join(__viewpath, view + '.' + extension), 'utf8')
  }
  catch (err){
    return null
  }
}
function getTemplate(view) { return getContent(view, 'html') }
function getPartials(view, output) {
  if (typeof view == 'string') {
    var content = getContent(view, 'mustache')
    if (content) {
      var result = output || {}
      Mustache.parse(content, ['<!{{', '}}>']).forEach(function(value, index, array) {
        if (value[0] === '?') {
          result[value[1]] = value[4]
        }
      })
      return result
    }
  } else if (typeof view == 'object') {
    var result = view
    if (output) {
      for (name in output) {
        result[name] = output[name]
      }
    }
    return result
  }
  return output
}

module.exports = {
  getTemplate: getTemplate,
  getPartials: getPartials,
  render     : Mustache.render,
  renderView : function(view, model, partialViews) {
    var template = getTemplate(view)
    var partials;
    if (typeof partialViews == 'object') {
      partials = partialViews
    } else {
      if (typeof partialViews == 'string') {
        partials = getPartials(partialViews)
      } else if (Array.isArray(partialViews)) {
        partialViews.forEach((element) => {
          partials = getPartials(element, partials)
        })
      }
    }
    return Mustache.render(template, model, partials)
  },
}