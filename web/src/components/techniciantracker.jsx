// web/src/components/TechnicianTracker.jsx
import React, { useState } from 'react';
import axios from 'axios';
import ReactSelect from 'react-select';
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import {
  Users,
  ScanLine,
  Trash2,
  Plus,
  Save
} from 'lucide-react';

const uniformSets = [
  'Summer Set A',
  'Summer Set B',
  'Winter Set A',
  'Winter Set B',
  'Formal Set'
];

// --- API calls ---
const fetchTechs = () =>
  axios.get('/api/technicians').then((res) => res.data);
const addTech = (tech) =>
  axios.post('/api/technicians', tech).then((res) => res.data);
const deleteTech = (id) =>
  axios.delete(`/api/technicians/${id}`).then((res) => res.data);
const recordCheckIn = ({ id, uniformSet }) =>
  axios
    .post(`/api/technicians/${id}/checkin`, { uniformSet })
    .then((res) => res.data);

export default function TechnicianTracker() {
  const [view, setView] = useState('admin');
  const [newName, setNewName] = useState('');
  const [newTechId, setNewTechId] = useState('');
  const [selectedTechId, setSelectedTechId] = useState(null);
  const [selectedUniform, setSelectedUniform] = useState(uniformSets[0]);

  const qc = useQueryClient();
  const { data: techs = [], isLoading } = useQuery(['techs'], fetchTechs);
  const addTechM = useMutation(addTech, {
    onSuccess: () => qc.invalidateQueries(['techs'])
  });
  const deleteTechM = useMutation(deleteTech, {
    onSuccess: () => qc.invalidateQueries(['techs'])
  });
  const checkInM = useMutation(recordCheckIn, {
    onSuccess: () => qc.invalidateQueries(['techs'])
  });

  if (isLoading) return <p className="p-6">Loading technicians...</p>;

  // transform for ReactSelect
  const techOptions = techs.map((t) => ({
    value: t.id,
    label: `${t.name} (ID ${t.techId})`
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center">
          <Users className="w-6 h-6 mr-2" />
          <h1 className="text-2xl font-bold">Technician Tracker</h1>
        </div>
      </header>

      <nav className="max-w-4xl mx-auto mt-4 flex space-x-4">
        <button
          onClick={() => setView('admin')}
          className={`flex items-center px-4 py-2 rounded ${
            view === 'admin'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-blue-600 border'
          }`}
        >
          <Users className="w-4 h-4 mr-1" />
          Admin
        </button>
        <button
          onClick={() => setView('checkin')}
          className={`flex items-center px-4 py-2 rounded ${
            view === 'checkin'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-blue-600 border'
          }`}
        >
          <ScanLine className="w-4 h-4 mr-1" />
          Check-In
        </button>
      </nav>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {view === 'admin' && (
          <>
            {/* Technician List */}
            <section>
              <h2 className="text-xl font-semibold mb-2">Technicians</h2>
              <table className="w-full bg-white shadow rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Tech ID</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Last Check-In</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {techs.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-3">{t.techId}</td>
                      <td className="p-3">{t.name}</td>
                      <td className="p-3">
                        {t.checkIns.length > 0
                          ? new Date(t.checkIns[0].createdAt).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => deleteTechM.mutate(t.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={deleteTechM.isLoading}
                        >
                          <Trash2 className="w-5 h-5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Add New Technician */}
            <section className="bg-white p-6 shadow rounded-lg">
              <h3 className="text-lg font-semibold mb-4">
                <Plus className="w-4 h-4 inline mr-1" />
                Add New Technician
              </h3>
              <div className="flex space-x-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium mb-1">Tech ID</label>
                  <input
                    type="number"
                    value={newTechId}
                    onChange={(e) => setNewTechId(e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="1001"
                  />
                </div>
                <button
                  onClick={() =>
                    addTechM.mutate({
                      name: newName,
                      techId: parseInt(newTechId, 10),
                      barcodeValue: `TECH-${String(newTechId).padStart(4, '0')}`
                    })
                  }
                  disabled={!newName || !newTechId || addTechM.isLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Add
                </button>
              </div>
            </section>
          </>
        )}

        {view === 'checkin' && (
          <section className="bg-white p-6 shadow rounded-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <ScanLine className="w-4 h-4 inline mr-1" />
              Technician Check-In
            </h3>
            <div className="space-y-4">
              {/* Technician picker with react-select */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Select Technician
                </label>
                <ReactSelect
                  options={techOptions}
                  value={techOptions.find((o) => o.value === selectedTechId) || null}
                  onChange={(opt) => setSelectedTechId(opt ? opt.value : null)}
                  isClearable
                  placeholder="Type or scroll to find a tech…"
                  styles={{
                    menu: (p) => ({ ...p, maxHeight: 200 }),
                    menuList: (p) => ({ ...p, maxHeight: 200, overflowY: 'auto' })
                  }}
                />
              </div>

              {/* Uniform set picker */}
              <div>
                <label className="block text-sm font-medium mb-1">Uniform Set</label>
                <select
                  value={selectedUniform}
                  onChange={(e) => setSelectedUniform(e.target.value)}
                  className="w-full border p-2 rounded"
                >
                  {uniformSets.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Record check-in */}
              <button
                onClick={() =>
                  checkInM.mutate({ id: selectedTechId, uniformSet: selectedUniform })
                }
                disabled={!selectedTechId || checkInM.isLoading}
                className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
              >
                <Save className="w-4 h-4 inline mr-1" />
                Record Check-In
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
