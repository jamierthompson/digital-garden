import {note} from './documents/note'
import {project} from './documents/project'
import {siteSettings} from './documents/siteSettings'
import {figure} from './objects/figure'
import {liveEmbed} from './objects/liveEmbed'
import {portableText} from './objects/portableText'

export const schemaTypes = [
  // Documents
  project,
  siteSettings,
  note,
  // Objects / blocks
  portableText,
  liveEmbed,
  figure,
]
