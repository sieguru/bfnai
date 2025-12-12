import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

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
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faHome, faFileWord, faLayerGroup, faSearch, faRobot,
  faCloudUploadAlt, faCheckCircle, faExclamationCircle, faSpinner,
  faTrash, faEye, faCog, faChevronRight, faChevronDown,
  faFolder, faFileAlt, faCopy, faUser, faPaperPlane,
  faTimes, faPlus, faHistory, faBars, faArrowLeft,
  faExternalLinkAlt, faQuoteLeft, faStar, faThumbsUp, faThumbsDown,
  faSync, faFilter, faList, faTree, faFile, faPlay, faCheck,
  faExclamationTriangle, faClock, faDatabase, faServer
)

import './assets/main.css'

const app = createApp(App)

app.component('font-awesome-icon', FontAwesomeIcon)
app.use(router)

app.mount('#app')
