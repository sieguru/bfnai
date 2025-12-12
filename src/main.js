import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

/* FontAwesome */
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faHome,
  faFileWord,
  faLayerGroup,
  faSearch,
  faRobot,
  faCloudUploadAlt,
  faCheckCircle,
  faExclamationCircle,
  faSpinner,
  faTrash,
  faEye,
  faCog,
  faChevronRight,
  faChevronDown,
  faFolder,
  faFileAlt,
  faCopy,
  faUser,
  faPaperPlane,
  faTimes,
  faPlus,
  faHistory,
  faBars,
  faArrowLeft,
  faExternalLinkAlt,
  faQuoteLeft,
  faStar,
  faThumbsUp,
  faThumbsDown,
  faSync,
  faFilter,
  faList,
  faTree,
  faFile,
  faPlay,
  faCheck,
  faExclamationTriangle,
  faClock,
  faDatabase,
  faServer,
  faGlobe,
  faHashtag,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faHome, faFileWord, faLayerGroup, faSearch, faRobot,
  faCloudUploadAlt, faCheckCircle, faExclamationCircle, faSpinner,
  faTrash, faEye, faCog, faChevronRight, faChevronDown,
  faFolder, faFileAlt, faCopy, faUser, faPaperPlane,
  faTimes, faPlus, faHistory, faBars, faArrowLeft,
  faExternalLinkAlt, faQuoteLeft, faStar, faThumbsUp, faThumbsDown,
  faSync, faFilter, faList, faTree, faFile, faPlay, faCheck,
  faExclamationTriangle, faClock, faDatabase, faServer, faGlobe, faHashtag,
  faInfoCircle
)

import './assets/main.css'

const app = createApp(App)

app.component('font-awesome-icon', FontAwesomeIcon)
app.use(router)
app.use(i18n)

app.mount('#app')
