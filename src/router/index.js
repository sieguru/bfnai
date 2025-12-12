import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import DocumentsView from '../views/DocumentsView.vue'
import ChunksView from '../views/ChunksView.vue'
import SearchView from '../views/SearchView.vue'
import AgentView from '../views/AgentView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/documents',
      name: 'documents',
      component: DocumentsView,
    },
    {
      path: '/chunks',
      name: 'chunks',
      component: ChunksView,
    },
    {
      path: '/search',
      name: 'search',
      component: SearchView,
    },
    {
      path: '/agent',
      name: 'agent',
      component: AgentView,
    },
  ],
})

export default router
