using CncMonitoring.Application.Interfaces;
using CncMonitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CncMonitoring.Infrastructure.Persistence.Repositories;

public class MachineRepository : IMachineRepository
{
    private readonly CncDbContext _db;
    public MachineRepository(CncDbContext db) => _db = db;

    public async Task<IReadOnlyList<Machine>> GetAllActiveAsync(CancellationToken ct)
        => await _db.Machines.Where(m => m.IsActive).OrderBy(m => m.MachineCode).ToListAsync(ct);

    public async Task<Machine?> GetByCodeAsync(string machineCode, CancellationToken ct)
        => await _db.Machines.FirstOrDefaultAsync(m => m.MachineCode == machineCode, ct);

    public async Task<Machine?> GetByIdAsync(int id, CancellationToken ct)
        => await _db.Machines.FindAsync([id], ct);

    public async Task<Machine> UpsertAsync(Machine machine, CancellationToken ct)
    {
        if (machine.Id == 0)
            _db.Machines.Add(machine);
        else
            _db.Machines.Update(machine);
        await _db.SaveChangesAsync(ct);
        return machine;
    }
}
