export interface NavigationItem {
  label: string;
  route: string;
  icon: string;
  children?: NavigationItem[];
}

export const manufacturerNavigation: NavigationItem[] = [
  {
    label: 'Dashboard',
    route: '/manufacturer/dashboard',
    icon: 'grid'
  },
  {
    label: 'Products',
    route: '/manufacturer/products',
    icon: 'package'
  },
  {
    label: 'Inventory',
    route: '/manufacturer/inventory',
    icon: 'layers'
  },
  {
    label: 'Purchase Orders',
    route: '/manufacturer/purchase-orders',
    icon: 'file-text'
  },
  {
    label: 'Shipments',
    route: '/manufacturer/shipments',
    icon: 'truck'
  },
  {
    label: 'Logistics',
    route: '/manufacturer/logistics',
    icon: 'map',
    children: [
      {
        label: 'Active Trips',
        route: '/manufacturer/logistics/trips',
        icon: 'route'
      },
      {
        label: 'Live Map',
        route: '/manufacturer/logistics/live-map',
        icon: 'map-pin'
      },
      {
        label: 'Drivers',
        route: '/manufacturer/drivers',
        icon: 'users'
      },
      {
        label: 'Vehicles',
        route: '/manufacturer/vehicles',
        icon: 'truck'
      }
    ]
  },
  {
    label: 'Staff',
    route: '/manufacturer/staff',
    icon: 'users'
  },
  {
    label: 'Warehouses',
    route: '/manufacturer/warehouses',
    icon: 'warehouse'
  },
  {
    label: 'Reports',
    route: '/manufacturer/reports',
    icon: 'bar-chart'
  },
  {
    label: 'Settings',
    route: '/manufacturer/settings',
    icon: 'settings'
  }
];